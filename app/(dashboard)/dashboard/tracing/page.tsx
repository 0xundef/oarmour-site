'use client'

import React, { useState } from 'react';
import SearchBar from "@/components/searchbar";
import { Graph } from "@/components/graph";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SearchResult {
  id: number;
  title: string;
  description: string;
}

export default function Page() {
  const [results, setResults] = useState<SearchResult[]>([]);

  const handleSearch = async (searchTerm: string) => {
    try {
      const response = await fetch('/api/tracing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchTerm }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      // const data: SearchResult[] = await response.json();
      // setResults(data);
    } catch (error) {
      console.error('Error fetching search results:', error);
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-10 ">
          <Card className="col-span-10">
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <SearchBar placeholder="Enter" onSearch={handleSearch} />
            </div>
          </Card>
          <Card className="col-span-7">
            <CardHeader>
              <CardTitle>Discover</CardTitle>
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
      </div>
    </ScrollArea>
  );
}