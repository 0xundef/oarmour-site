import SearchBar from "@/components/searchbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Page() {
  return (
    <ScrollArea className="h-full">
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-10 ">
          <Card className="col-span-10">
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
              <SearchBar placeholder="Enter" />
            </div>
          </Card>
          <Card className="col-span-10">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="pl-2 h-[300px]">
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}