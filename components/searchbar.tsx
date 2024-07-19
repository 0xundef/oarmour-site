'use client'

import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const SearchBar: React.FC<{ placeholder: string }> = ({ placeholder }) => {
  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const searchTerm = formData.get('search') as string;
    
    if (searchTerm.trim()) {
      // Implement your search logic here
      console.log('Searching for:', searchTerm);
      // You can replace this with an API call or any other search functionality
      alert(`You searched for: ${searchTerm}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="flex w-full max-w-sm items-center space-x-2">
      <Input
        type="search"
        name="search"
        placeholder={placeholder}
        className="flex-grow bg-background text-foreground"
      />
      <Button type="submit" variant="default">
        <Search className="mr-2 h-4 w-4" /> Search
      </Button>
    </form>
  );
};

export default SearchBar;