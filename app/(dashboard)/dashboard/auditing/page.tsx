import BreadCrumb from "@/components/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import SearchBar from "@/components/searchbar";

const breadcrumbItems = [{ title: "Auditing", link: "/dashboard/auditing" }];

export default function Page() {
  return (
    <ScrollArea className="h-full">
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <BreadCrumb items={breadcrumbItems} />
      <SearchBar />
    </div>
  </ScrollArea>
  );
}