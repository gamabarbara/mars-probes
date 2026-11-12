import { directionLabels } from '../contants/directionLabels';
import { useMoveForm } from '../modules/probes/hooks/useMoveForm';
import type { MoveFormProps } from '../modules/probes/hooks/useMoveForm';

export function MoveForm(props: MoveFormProps) {
  const { moving } = props;
  const { commands, setCommands, error, position, handleSubmit } =
    useMoveForm(props);
  return (
    <form className="move-form" aria-label="Move probe" onSubmit={handleSubmit}>
      <label htmlFor="probe-commands">Commands</label>
      <textarea
        id="probe-commands"
        className="mission-field"
        rows={2}
        value={commands}
        onChange={event => setCommands(event.target.value)}
        aria-describedby="commands-help"
        autoCapitalize="off"
        spellCheck={false}
        disabled={moving}
        placeholder="e.g. MRM"
      />
      <p id="commands-help" className="muted text-sm">
        Use 1 to 1000 uppercase commands without spaces.
      </p>
      <div role="group" aria-label="Add a command" className="command-keys">
        {[
          ['L', 'Left'],
          ['M', 'Move'],
          ['R', 'Right'],
        ].map(([command, label]) => (
          <button
            key={command}
            type="button"
            className="mission-button"
            disabled={moving || commands.length >= 1000}
            onClick={() => setCommands(value => value + command)}
          >
            <kbd>{command}</kbd> {label}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={moving}
        className="mission-button primary"
      >
        {moving ? 'Sending…' : 'Send commands'}
      </button>
      {error && (
        <p lang="en" role="alert" className="mission-error">
          {error}
        </p>
      )}
      {position && (
        <p role="status" className="mission-success">
          Move confirmed. Position: ({position.x}, {position.y}) · Direction:{' '}
          {directionLabels[position.direction]}
        </p>
      )}
    </form>
  );
}
