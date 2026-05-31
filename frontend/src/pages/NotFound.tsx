import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="grid min-h-full place-items-center px-4">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or you don't have access.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link to="/">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
