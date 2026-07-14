import { Library } from "lucide-react";
import { ComingSoonPage } from "../ComingSoonPage";

export default function LibraryPage() {
  return (
    <ComingSoonPage
      title="资料库"
      description="单词表、语法资料和阅读材料将统一收录在这里。"
      icon={<Library size={26} style={{ color: "var(--app-accent)" }} />}
    />
  );
}