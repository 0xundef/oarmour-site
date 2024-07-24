import { promises as fs } from "fs"
import path from "path"
import { Metadata } from "next"
import { z } from "zod"
import { columns } from "./components/columns"
import { DataTable } from "./components/data-table"
import { taskSchema } from "./data/schema"

export const metadata: Metadata = {
  title: "Alerts",
  description: "Alerts detection.",
}

// Simulate a database read for tasks.
async function getTasks() {
  const data = await fs.readFile(
    path.join(process.cwd(), "app/(dashboard)/dashboard/alerts/data/tasks.json")
  )

  const tasks = JSON.parse(data.toString())

  return z.array(taskSchema).parse(tasks)
}

export default async function TaskPage() {
  const alerts = await getTasks()

  return (
    <>
      <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Real-Time detection alerts</h2>
            <p className="text-muted-foreground">
              Here&apos;s a list of your tasks for this month!
            </p>
          </div>
        </div>
        <DataTable data={alerts} columns={columns} />
      </div>
    </>
  )
}
