import { notFound } from "next/navigation";
import { AdminBlogEditor } from "@/components/admin-blog-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <AdminBlogEditor key={id} id={id} />;
}
