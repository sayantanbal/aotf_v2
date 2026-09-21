import AdPlacementSlot from "@/components/AdPlacementSlot";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-center justify-center gap-4 mb-30">
      {children}
    </section>
  );
}
