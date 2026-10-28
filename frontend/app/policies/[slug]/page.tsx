import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PolicyDocument } from "@/components/policy-document";
import { getPolicy, policies } from "@/lib/policies";
import { serverApi } from "@/lib/server";
import type { Settings } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

// Unknown slugs get a real 404 before the root loading UI starts streaming.
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(policies).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const policy = getPolicy(slug);
  return {
    title: policy?.title || "Policy unavailable",
    description: policy?.description,
    alternates: policy ? { canonical: `/policies/${slug}` } : undefined,
    robots: { index: false, follow: true },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const policy = getPolicy(slug);
  if (!policy) notFound();
  const { data: settings } = await serverApi<Settings>("/settings");
  return (
    <PolicyDocument slug={slug} policy={policy} settings={settings || {}} />
  );
}
