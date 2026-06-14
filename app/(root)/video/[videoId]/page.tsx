import { redirect } from "next/navigation";

import { VideoDetailHeader, VideoInfo, VideoPlayer } from "@/components";
import { getTranscript, getVideoById } from "@/lib/actions/video";

const page = async ({ params }: Params) => {
  const { videoId } = await params;

  const record = await getVideoById(videoId);
  if (!record || !record.video) redirect("/404");
  const { user, video } = record;

  const transcript = await getTranscript(videoId);

  return (
    <main className="wrapper page">
      <VideoDetailHeader
        title={video.title}
        createdAt={video.createdAt}
        userImg={user?.image}
        username={user?.name}
        videoId={video.videoId}
        ownerId={video.userId}
        visibility={video.visibility}
        thumbnailUrl={video.thumbnailUrl}
      />

      <section className="video-details">
        <div className="content">
          <VideoPlayer
            videoId={video.videoId}
            videoUrl={video.videoUrl}
            thumbnailUrl={video.thumbnailUrl}
            transcript={transcript}
          />
        </div>

        <VideoInfo
          transcript={transcript}
          title={video.title}
          createdAt={video.createdAt}
          description={video.description}
          videoId={videoId}
          videoUrl={video.videoUrl}
        />
      </section>
    </main>
  );
};

export default page;
