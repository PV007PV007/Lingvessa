import { LessonPlayer } from '../../../lesson/player';
export default async function LessonPage({params}:{params:Promise<{runId:string}>}) {
  const {runId}=await params; return <LessonPlayer key={runId} runId={runId}/>;
}
