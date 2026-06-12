import type { CommandRecord } from '../domain/actions'

type CommandHistoryProps = {
  records: CommandRecord[]
}

export function CommandHistory({ records }: CommandHistoryProps) {
  if (records.length === 0) {
    return <p className="history-empty">No commands yet.</p>
  }

  return (
    <ol className="history-list">
      {records.map((record) => (
        <li className="history-item" key={record.id}>
          <div className={`history-source ${record.parseSource}`}>[{record.parseSource}]</div>
          <div>
            <p>{record.rawText}</p>
            <span>
              -&gt; {record.actionType} {record.status}
            </span>
            <small>{record.message}</small>
          </div>
        </li>
      ))}
    </ol>
  )
}
