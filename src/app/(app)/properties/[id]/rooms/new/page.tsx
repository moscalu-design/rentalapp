import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { RoomForm } from "@/components/rooms/RoomForm";
import prisma from "@/lib/prisma";

export default async function NewRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) notFound();

  return (
    <div className="flex flex-col flex-1">
      <TopBar title="Add Room" description={property.name} />
      <div className="flex-1 p-6">
        <RoomForm propertyId={id} />
      </div>
    </div>
  );
}
