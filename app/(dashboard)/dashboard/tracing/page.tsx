import BreadCrumb from "@/components/breadcrumb";
import { Input } from "@/components/ui/input";
import SearchBar from "@/components/searchbar";
import {Graph} from "@/components/graph";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const breadcrumbItems = [{ title: "Tracing", link: "/dashboard/tracing" }];

export default function Page() {
  return (
    <ScrollArea className="h-full">
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <BreadCrumb items={breadcrumbItems} />
      <SearchBar placeholder="Enter" />
    </div>
    <div className="grid gap-4 grid-cols-1 md:grid-cols-10">
              <Card className="col-span-7">
                <CardHeader>
                  <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent className="pl-2 h-[300px]">
                <Graph />
                </CardContent>
              </Card>
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Recent Sales</CardTitle>
                  <CardDescription>
                    You made 265 sales this month.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  Test
                </CardContent>
              </Card>
              </div>
{/* 
              <div className="grid gap-4 grid-cols-1 md:grid-cols-10 lg:grid-cols-10">
  <Card className="col-span-1 md:col-span-7 lg:col-span-7">
    <CardHeader>
      <CardTitle>Overview</CardTitle>
    </CardHeader>
    <CardContent className="p1-2">
      <Graph />
    </CardContent>
  </Card>
  <Card className="col-span-1 md:col-span-3 lg:col-span-3">
    <CardHeader>
      <CardTitle>Recent Sales</CardTitle>
      <CardDescription>
        You made 265 sales this month.
      </CardDescription>
    </CardHeader>
    <CardContent>
      Test
    </CardContent>
  </Card>
</div> */}
  </ScrollArea>
  );
}