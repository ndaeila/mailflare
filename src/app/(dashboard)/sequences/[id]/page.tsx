"use client";

import { use } from "react";
import { SequenceEditor } from "@/components/sequences/sequence-editor";

export default function SequencePage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	return <SequenceEditor sequenceId={id === "new" ? null : id} />;
}
