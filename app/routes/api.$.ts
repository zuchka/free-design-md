import type { Route } from "./+types/api.$";
import { apiApp } from "../../server/api-app.js";

export function loader({ request }: Route.LoaderArgs) {
  return apiApp.fetch(request);
}

export function action({ request }: Route.ActionArgs) {
  return apiApp.fetch(request);
}
