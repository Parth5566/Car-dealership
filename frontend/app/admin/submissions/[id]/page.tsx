import { SubmissionDetail } from "@/components/submission-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <SubmissionDetail id={(await params).id} admin />;
}
