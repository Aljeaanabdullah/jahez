import { notFound } from "next/navigation";
import { FaceCheck } from "./face-check";

// Development-only page used by the browser test e2e/face-model.spec.ts to run the
// web face model on fixed inputs. It does not exist in production builds.
export default function FaceCheckPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FaceCheck />;
}
