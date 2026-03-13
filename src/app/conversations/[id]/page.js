"use client";

import { useParams } from "next/navigation";
import HomePage from "../../../components/HomePage";

export default function ConversationPage() {
  const { id } = useParams();
  return <HomePage initialConversationId={id} />;
}
