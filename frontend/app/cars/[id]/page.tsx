import { permanentRedirect, notFound } from "next/navigation";
import { serverApi } from "@/lib/server";
import { Vehicle } from "@/lib/types";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await serverApi<Vehicle>("/vehicles/" + id);
  if (!data) notFound();
  permanentRedirect(`/vehicles/${data.id}/${data.slug}`);
}
