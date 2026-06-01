import { BundleView } from "@/components/bundle-view";

export default async function BundlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BundleView id={id} />;
}
