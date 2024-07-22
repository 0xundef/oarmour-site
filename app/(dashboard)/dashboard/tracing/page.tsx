import BreadCrumb from "@/components/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import SearchBar from "@/components/searchbar";
import CytoscapeComponent from "react-cytoscapejs";

const breadcrumbItems = [{ title: "Tracing", link: "/dashboard/tracing" }];

export default function Page() {
  return (
    <ScrollArea className="h-full">
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <BreadCrumb items={breadcrumbItems} />
      <SearchBar placeholder="Enter TXID" />
    </div>
    <CytoscapeComponent
  elements={[
    { data: { id: 'one', label: 'Node 1' }, position: { x: 0, y: 0 } },
    { data: { id: 'two', label: 'Node 2' }, position: { x: 100, y: 0 } },
    {
      data: { source: 'one', target: 'two', label: 'Edge from Node1 to Node2' }
    }
  ]}
/>
  </ScrollArea>
  );
}