'use client'

import React from 'react';
import CytoscapeComponent from 'react-cytoscapejs';

export function Graph() {
  const elements = [
    { data: { id: 'one', label: 'Node 1' }, position: { x: 500, y: 500 } },
    { data: { id: 'two', label: 'Node 2' }, position: { x: 1000, y: 1000 } },
    { data: { source: 'one', target: 'two', label: 'Edge from Node1 to Node2' } }
 ];

 return <CytoscapeComponent elements={elements} />;
};