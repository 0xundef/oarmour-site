"use client"

import { Card, CardContent } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Copy, Bell } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useEffect, useState } from "react"
import { getExtensions } from "@/app/actions/get-extensions"

type ThreatAlert = {
  id: string
  extensionName: string
  extensionId: string
  version: string
  publisher: string
  lastUpdate: string
  risk: "Critical" | "High" | "Medium" | "Low" | "Unknown" | "Analysis In Progress"
  analysisStatus: string
}

const OperationCell = ({ extensionId }: { extensionId: string }) => {
  const { toast } = useToast()

  const handleCopy = () => {
    navigator.clipboard.writeText(extensionId)
    toast({
      description: "Extension ID copied to clipboard",
    })
  }

  const handleSubscribe = () => {
    toast({
      description: "Subscribed to alert events",
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={handleCopy} title="Copy Extension ID">
        <Copy className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={handleSubscribe} title="Subscribe Alert Event">
        <Bell className="h-4 w-4" />
      </Button>
    </div>
  )
}

const columns: ColumnDef<ThreatAlert>[] = [
  {
    accessorKey: "extensionName",
    header: "Extension Name",
    cell: ({ row }) => {
      const storeUrl = `https://chromewebstore.google.com/detail/${row.original.extensionId}`
      return (
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-blue-500 underline-offset-4 text-blue-600 hover:text-blue-800 hover:decoration-blue-700"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="font-medium">{row.getValue("extensionName")}</span>
        </a>
      )
    },
  },
  {
    accessorKey: "version",
    header: "Version",
  },
  {
    accessorKey: "publisher",
    header: "Publisher",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.getValue("publisher") || 'N/A'}</span>
    ),
  },
  {
    accessorKey: "lastUpdate",
    header: "Last Update",
  },
  {
    accessorKey: "risk",
    header: "Risk Level",
    cell: ({ row }) => {
      const risk = row.getValue("risk") as string
      const status = row.original.analysisStatus

      if (status === 'RUNNING' || status === 'PENDING') {
         return (
            <div className="flex items-center gap-2" title="Analysis In Progress">
                <div className="h-2 w-12 rounded-full bg-gray-300 animate-pulse" />
                <span className="text-xs text-gray-500">Analyzing...</span>
            </div>
         )
      }
      
      let colorClass = "bg-gray-400" // Default Unknown
      if (risk === "SAFE") colorClass = "bg-green-500"
      if (risk === "CAUTION") colorClass = "bg-yellow-500"
      if (risk === "HIGH" || risk === "CRITICAL") colorClass = "bg-red-500"

      return (
        <div className="flex items-center" title={risk}>
          <div className={`h-2 w-12 rounded-full ${colorClass}`} />
        </div>
      )
    },
  },
  {
    id: "operation",
    header: "Operation",
    cell: ({ row }) => <OperationCell extensionId={row.original.extensionId} />,
  },
]

export function ThreatAlerts() {
  const [data, setData] = useState<ThreatAlert[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
        const extensions = await getExtensions();
        
        const formattedData: ThreatAlert[] = extensions.map(ext => ({
            id: ext.id,
            extensionName: ext.name,
            extensionId: ext.storeId,
            version: ext.version || 'N/A',
            publisher: ext.publisher || 'N/A',
            lastUpdate: new Date(ext.updatedAt).toLocaleDateString(),
            risk: ext.riskLevel as any,
            analysisStatus: ext.analysisStatus
        }));
        
        setData(formattedData);
    } catch (error) {
        console.error("Failed to fetch extensions", error);
    } finally {
        setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // Poll every 5 seconds to update status
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && data.length === 0) {
      return <div className="p-4 text-center text-muted-foreground">Loading extensions...</div>
  }

  return (
    <Card className="h-full border-none shadow-none">
      <CardContent className="p-0">
        <DataTable data={data} columns={columns} searchKey="extensionName" />
      </CardContent>
    </Card>
  )
}
