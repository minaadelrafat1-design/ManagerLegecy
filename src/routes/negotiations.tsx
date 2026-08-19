import { createFileRoute } from "@tanstack/react-router";
import NegotiationsRoute from "./-negotiations";

export const Route = createFileRoute("/negotiations")({
  component: NegotiationsRoute,
});
