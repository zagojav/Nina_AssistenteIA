import VisualizarRelatorio from "@/components/curador/VisualizarRelatorio";

export default async function PaginaRelatorio({
  params,
}: {
  params: Promise<{ relatorioId: string }>;
}) {
  const { relatorioId } = await params;
  return <VisualizarRelatorio relatorioId={relatorioId} />;
}
