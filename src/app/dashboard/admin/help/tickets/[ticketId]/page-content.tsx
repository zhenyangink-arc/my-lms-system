import HelpTicketViewPage from "@/features/help-center/components/help-ticket-view-page";

export default async function AdminHelpTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  return <HelpTicketViewPage ticketId={ticketId} />;
}
