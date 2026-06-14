"use server";

import { db } from "@/drizzle/db";
import { videos, user } from "@/drizzle/schema";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { randomUUID } from "crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, getR2Bucket, publicUrlFor } from "@/lib/r2";
import { doesTitleMatch, getOrderByClause, withErrorHandling } from "@/lib/utils";
import aj, { fixedWindow, request } from "../arcjet";

const UPLOAD_URL_TTL_SECONDS = 60 * 10;

const validateWithArcjet = async (fingerPrint: string) => {
  const rateLimit = aj.withRule(
    fixedWindow({
      mode: "LIVE",
      window: "1m",
      max: 2,
      characteristics: ["fingerprint"],
    })
  );
  const req = await request();
  const decision = await rateLimit.protect(req, { fingerprint: fingerPrint });
  if (decision.isDenied()) {
    throw new Error("Rate Limit Exceeded");
  }
};

const revalidatePaths = (paths: string[]) => {
  paths.forEach((path) => revalidatePath(path));
};

const getSessionUserId = async (): Promise<string> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthenticated");
  return session.user.id;
};

const buildVideoWithUserQuery = () =>
  db
    .select({
      video: videos,
      user: { id: user.id, name: user.name, image: user.image },
    })
    .from(videos)
    .leftJoin(user, eq(videos.userId, user.id));

const presignPut = async (key: string, contentType: string) => {
  const command = new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
};

export const getVideoUploadUrl = withErrorHandling(
  async (contentType: string = "video/webm") => {
    await getSessionUserId();
    const videoId = randomUUID();
    const key = `videos/${videoId}.webm`;
    const uploadUrl = await presignPut(key, contentType);
    return {
      videoId,
      uploadUrl,
      publicUrl: publicUrlFor(key),
    };
  }
);

export const getThumbnailUploadUrl = withErrorHandling(
  async (videoId: string, contentType: string = "image/jpeg") => {
    await getSessionUserId();
    const ext = contentType.split("/")[1] ?? "jpg";
    const key = `thumbnails/${videoId}.${ext}`;
    const uploadUrl = await presignPut(key, contentType);
    return {
      uploadUrl,
      publicUrl: publicUrlFor(key),
    };
  }
);

export const saveVideoDetails = withErrorHandling(
  async (videoDetails: VideoDetails & { videoUrl: string }) => {
    const userId = await getSessionUserId();
    await validateWithArcjet(userId);

    const now = new Date();
    await db.insert(videos).values({
      videoId: videoDetails.videoId,
      title: videoDetails.title,
      description: videoDetails.description,
      videoUrl: videoDetails.videoUrl,
      thumbnailUrl: videoDetails.thumbnailUrl,
      visibility: videoDetails.visibility,
      duration: videoDetails.duration ?? null,
      userId,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePaths(["/"]);

    after(async () => {
      try {
        await runTranscription(videoDetails.videoId, videoDetails.videoUrl);
      } catch (err) {
        console.error("Background transcription failed:", err);
      }
    });

    return { videoId: videoDetails.videoId };
  }
);

function keyFromPublicUrl(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    return url.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
}

function formatVttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

function toVtt(json: {
  text: string;
  segments?: Array<{ start: number; end: number; text: string }>;
}): string {
  if (!json.segments || json.segments.length === 0) {
    return `WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n${json.text.trim()}\n`;
  }
  const cues = json.segments
    .map(
      (seg) =>
        `${formatVttTime(seg.start)} --> ${formatVttTime(seg.end)}\n${seg.text.trim()}`
    )
    .join("\n\n");
  return `WEBVTT\n\n${cues}\n`;
}

async function runTranscription(videoId: string, videoUrl: string) {
  console.log(`[transcribe] start videoId=${videoId}`);

  const key = keyFromPublicUrl(videoUrl);
  if (!key) throw new Error(`Could not parse R2 key from ${videoUrl}`);
  console.log(`[transcribe] downloading from R2 key=${key}`);

  const obj = await r2.send(
    new GetObjectCommand({ Bucket: getR2Bucket(), Key: key })
  );
  const bytes = await obj.Body!.transformToByteArray();
  const videoBlob = new Blob([bytes.buffer as ArrayBuffer], {
    type: obj.ContentType || "video/webm",
  });
  console.log(
    `[transcribe] downloaded ${videoBlob.size} bytes, type=${videoBlob.type}`
  );

  const form = new FormData();
  form.append("file", videoBlob, `${videoId}.webm`);
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "verbose_json");

  console.log(`[transcribe] calling Groq...`);
  const groqResponse = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: form,
    }
  );
  if (!groqResponse.ok) {
    throw new Error(
      `Groq error ${groqResponse.status}: ${await groqResponse.text()}`
    );
  }
  const json = (await groqResponse.json()) as {
    text: string;
    segments?: Array<{ start: number; end: number; text: string }>;
  };
  console.log(
    `[transcribe] Groq OK: text=${json.text.length} chars, segments=${json.segments?.length ?? 0}`
  );
  const vtt = toVtt(json);

  await db
    .update(videos)
    .set({ transcript: vtt, updatedAt: new Date() })
    .where(eq(videos.videoId, videoId));

  console.log(`[transcribe] done videoId=${videoId}, vtt=${vtt.length} chars`);
  revalidatePath(`/video/${videoId}`);
}

export const getAllVideos = withErrorHandling(async (
  searchQuery: string = '',
  sortFilter?: string,
  pageNumber: number = 1,
  pageSize: number = 8,
) => {
  const session = await auth.api.getSession({ headers: await headers() })
  const currentUserId = session?.user.id;

  const canSeeTheVideos = or(
      eq(videos.visibility, 'public'),
      eq(videos.userId, currentUserId!),
  );

  const whereCondition = searchQuery.trim()
      ? and(
          canSeeTheVideos,
          doesTitleMatch(videos, searchQuery),
      )
      : canSeeTheVideos

    const [{ totalCount }] = await db
      .select({ totalCount: sql<number>`count(*)` })
      .from(videos)
      .where(whereCondition);
    const totalVideos = Number(totalCount || 0);
    const totalPages = Math.ceil(totalVideos / pageSize);

    const videoRecords = await buildVideoWithUserQuery()
      .where(whereCondition)
      .orderBy(
        sortFilter
          ? getOrderByClause(sortFilter)
          : sql`${videos.createdAt} DESC`
      )
      .limit(pageSize)
      .offset((pageNumber - 1) * pageSize);

    return {
      videos: videoRecords,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalVideos,
        pageSize,
      },
    };
  }
);

export const getVideoById = withErrorHandling(async (videoId: string) => {
  const [videoRecord] = await buildVideoWithUserQuery().where(
    eq(videos.videoId, videoId)
  );
  return videoRecord;
});

export const getTranscript = withErrorHandling(async (videoId: string) => {
  const [row] = await db
    .select({ transcript: videos.transcript })
    .from(videos)
    .where(eq(videos.videoId, videoId));
  return row?.transcript ?? "";
});

export const transcribeVideo = withErrorHandling(async (videoId: string) => {
  await getSessionUserId();
  const [row] = await db
    .select({ videoUrl: videos.videoUrl })
    .from(videos)
    .where(eq(videos.videoId, videoId));
  if (!row) throw new Error("Video not found");
  await runTranscription(videoId, row.videoUrl);
  return { ok: true };
});

export const incrementVideoViews = withErrorHandling(
  async (videoId: string) => {
    await db
      .update(videos)
      .set({ views: sql`${videos.views} + 1`, updatedAt: new Date() })
      .where(eq(videos.videoId, videoId));

    revalidatePaths([`/video/${videoId}`]);
    return {};
  }
);

export const getAllVideosByUser = withErrorHandling(
  async (
    userIdParameter: string,
    searchQuery: string = "",
    sortFilter?: string
  ) => {
    const currentUserId = (
      await auth.api.getSession({ headers: await headers() })
    )?.user.id;
    const isOwner = userIdParameter === currentUserId;

    const [userInfo] = await db
      .select({
        id: user.id,
        name: user.name,
        image: user.image,
        email: user.email,
      })
      .from(user)
      .where(eq(user.id, userIdParameter));
    if (!userInfo) throw new Error("User not found");

        /* eslint-disable @typescript-eslint/no-explicit-any */
    const conditions = [
      eq(videos.userId, userIdParameter),
      !isOwner && eq(videos.visibility, "public"),
      searchQuery.trim() && ilike(videos.title, `%${searchQuery}%`),
    ].filter(Boolean) as any[];

    const userVideos = await buildVideoWithUserQuery()
      .where(and(...conditions))
      .orderBy(
        sortFilter ? getOrderByClause(sortFilter) : desc(videos.createdAt)
      );

    return { user: userInfo, videos: userVideos, count: userVideos.length };
  }
);

export const updateVideoVisibility = withErrorHandling(
  async (videoId: string, visibility: Visibility) => {
    await validateWithArcjet(videoId);
    await db
      .update(videos)
      .set({ visibility, updatedAt: new Date() })
      .where(eq(videos.videoId, videoId));

    revalidatePaths(["/", `/video/${videoId}`]);
    return {};
  }
);


export const deleteVideo = withErrorHandling(
  async (videoId: string, thumbnailUrl: string) => {
    const [row] = await db
      .select({ videoUrl: videos.videoUrl })
      .from(videos)
      .where(eq(videos.videoId, videoId));

    const videoKey = row ? keyFromPublicUrl(row.videoUrl) : null;
    const thumbnailKey = keyFromPublicUrl(thumbnailUrl);

    if (videoKey) {
      await r2.send(
        new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: videoKey })
      );
    }
    if (thumbnailKey) {
      await r2.send(
        new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: thumbnailKey })
      );
    }

    await db.delete(videos).where(eq(videos.videoId, videoId));
    revalidatePaths(["/", `/video/${videoId}`]);
    return {};
  }
);
