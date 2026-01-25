"use client"

import { Card, CardContent } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Copy, Bell } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

type ThreatAlert = {
  id: string
  extensionName: string
  extensionId: string
  version: string
  lastUpdate: string
  rate: string
  risk: "Critical" | "High" | "Medium" | "Low"
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
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("extensionName")}</span>
    ),
  },
  {
    accessorKey: "version",
    header: "Version",
  },
  {
    accessorKey: "lastUpdate",
    header: "Last Update",
  },
  {
    accessorKey: "rate",
    header: "Rate",
  },
  {
    accessorKey: "risk",
    header: "Risk",
    cell: ({ row }) => {
      const risk = row.getValue("risk") as "Low" | "Medium" | "High" | "Critical"
      
      let colorClass = "bg-green-500"
      if (risk === "Medium") colorClass = "bg-yellow-500"
      if (risk === "High" || risk === "Critical") colorClass = "bg-red-500"

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

const mockAlerts: ThreatAlert[] = [
  {
    id: "1",
    extensionName: "MetaMask",
    extensionId: "nkbihfbeogaeaoehlefnkodbefgpgknn",
    version: "10.25.0",
    lastUpdate: "2024-05-10",
    rate: "4.8/5",
    risk: "Critical",
  },
  {
    id: "2",
    extensionName: "LastPass",
    extensionId: "hdokiejnpimakedhajhdlcegeplioahd",
    version: "4.101.0",
    lastUpdate: "2024-04-22",
    rate: "4.5/5",
    risk: "High",
  },
  {
    id: "3",
    extensionName: "AdBlock Plus",
    extensionId: "cfhdojbkjhnklbpkdaibdccddilifddb",
    version: "3.14.2",
    lastUpdate: "2024-03-15",
    rate: "4.3/5",
    risk: "Medium",
  },
  {
    id: "4",
    extensionName: "Honey",
    extensionId: "bmnlcjabgnpnenekpadlanbbkooimhnj",
    version: "14.1.0",
    lastUpdate: "2024-02-10",
    rate: "4.7/5",
    risk: "Low",
  },
  {
    id: "5",
    extensionName: "PDF Converter",
    extensionId: "kpdjmbiefanbdgnkcikhjjlhpifcodcn",
    version: "2.5.1",
    lastUpdate: "2024-01-05",
    rate: "3.2/5",
    risk: "Critical",
  },
]

export function ThreatAlerts() {
  return (
    <Card className="h-full border-none shadow-none">
      <CardContent className="p-0">
        <DataTable data={mockAlerts} columns={columns} searchKey="extensionName" />
      </CardContent>
    </Card>
  )
}
