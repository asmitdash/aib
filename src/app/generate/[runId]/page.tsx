import { ClarifyingForm } from "@/components/clarifying-form";

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col px-6 py-12">
      <ClarifyingForm runId={runId} />
    </div>
  );
}
