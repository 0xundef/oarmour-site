import BreadCrumb from "@/components/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import SearchBar from "@/components/searchbar";
import {Graph} from "@/components/graph";

const breadcrumbItems = [{ title: "Tracing", link: "/dashboard/tracing" }];

export default function Page() {
  return (
    <ScrollArea className="h-full">
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <BreadCrumb items={breadcrumbItems} />
      <SearchBar placeholder="Enter TXID" />
    </div>
    <Graph/>
  </ScrollArea>
  );
}