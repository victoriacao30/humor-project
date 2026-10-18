import VoteBoard from "@/app/components/VoteBoard";

export default async function GroupVote({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <VoteBoard groupId={Number(id)} />;
}
