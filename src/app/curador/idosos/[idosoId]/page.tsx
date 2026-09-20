import FichaIdoso from "@/components/curador/FichaIdoso";

export default async function PaginaFichaIdoso({
  params,
}: {
  params: Promise<{ idosoId: string }>;
}) {
  const { idosoId } = await params;
  return <FichaIdoso idosoId={idosoId} />;
}
