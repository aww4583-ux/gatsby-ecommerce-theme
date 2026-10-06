// Shown on per-store pages while "all stores" is selected in the header.
export function PickStore({ what }: { what: string }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4 text-center text-gray-600">
      اختر متجراً محدداً من الأعلى لعرض {what}.
    </main>
  );
}
