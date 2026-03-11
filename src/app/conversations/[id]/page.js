"use client";

import { use } from "react";
import Home from "../../page";

export default function ConversationPage({ params }) {
    const { id } = use(params);
    return <Home initialConversationId={id} />;
}
