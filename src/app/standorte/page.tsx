import { requireReadAccess } from "../../server/access";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LocationsPage() {
  try {
    await requireReadAccess();
  } catch {
    return <main className="startseite"><p className="marke">YGH</p><h1>Zugriff verweigert.</h1></main>;
  }
  redirect("/bestand");
}
