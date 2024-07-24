'use client'

import React, { useState } from 'react';
import SearchBar from "@/components/searchbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Page() {
  const [results, setResults] = useState([]);

  const handleSearch = async (searchTerm: string) => {
    try {
      const response = await fetch('/api/auditing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Use URLSearchParams to add query parameter
        body: JSON.stringify({ query: searchTerm }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      setResults(data);
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
          <Card className="col-span-10">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="pl-2 h-[300px] overflow-y-auto">
              <ul>
                {results.map((result, index) => (
                  <li key={index} className="py-2 border-b border-gray-200">
                    <h3 className="font-semibold">{result.title}</h3>
                    <p>{result.description}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}
