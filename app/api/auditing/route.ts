import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic' // defaults to auto

export async function POST(request: NextRequest) {
  const { query } = await request.json();
  console.log('Received search query:', query);

  // Perform search logic (e.g., database query) and return results
  const results = searchDatabase(query);

  return NextResponse.json(results);
}

// Dummy search function, replace with actual database query
function searchDatabase(query: string) {
  // Replace with your search logic
  const mockResults = [
    { id: 1, title: 'dddd', description: 'Description for result 1' },
    { id: 2, title: 'dddd', description: 'Description for result 2' },
    { id: 2, title: 'Result 2', description: 'Description for result 2' },
  ];
  return mockResults.filter(result =>
    result.title.toLowerCase().includes(query.toLowerCase())
  );
}
