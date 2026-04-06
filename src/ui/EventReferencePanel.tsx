/**
 * Shared event reference table and collapsible cards.
 * Used by CrazyScreen and ChaosScreen for the 40-event reference panel.
 */

import { EVENT_DATA } from '../data/eventData';
import ExpandableDetailPanel from './ExpandableDetailPanel';
import styles from './EventReferencePanel.module.css';

interface EventReferencePanelProps {
  introContent?: React.ReactNode;
}

export default function EventReferencePanel({ introContent }: EventReferencePanelProps) {
  return (
    <div data-testid="event-reference-panel">
      {introContent}

      {/* Event summary table */}
      <div className={styles.eventTableWrapper}>
        <table className={styles.eventTable} data-testid="event-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Duration</th>
              <th>Effect</th>
            </tr>
          </thead>
          <tbody>
            {EVENT_DATA.map((event) => (
              <tr key={event.eventType} data-testid={`event-row-${String(event.eventNumber)}`}>
                <td>{event.eventNumber}</td>
                <td>{event.name}</td>
                <td>{event.durationText}</td>
                <td>{event.mechanicalEffect.split('.')[0]}.</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Per-event collapsible cards */}
      <div className={styles.eventCardsContainer}>
        {EVENT_DATA.map((event) => (
          <ExpandableDetailPanel
            key={event.eventType}
            title={`#${String(event.eventNumber)} \u2014 ${event.name}`}
            summary={event.flavorText}
          >
            <p className={styles.mechanicalEffect}>{event.mechanicalEffect}</p>
            <p className={styles.duration}>Duration: {event.durationText}</p>
            {event.stackingNotes.length > 0 && (
              <div className={styles.stackingNotes}>
                <h4>Key Interactions</h4>
                <ul>
                  {event.stackingNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </ExpandableDetailPanel>
        ))}
      </div>

      {/* Event Interaction Overview */}
      <div className={styles.interactionOverview}>
        <h3 className={styles.sectionSubtitle}>Event Stacking</h3>
        <p className={styles.overviewText}>
          When multiple events are active, their effects combine. Newer events
          take precedence in conflicts. Each event ticks down independently.
          Double Trouble is a meta-event that triggers two other events simultaneously.
        </p>
        <p className={styles.overviewText}>
          Some events directly contradict each other (Royal Decree and Frozen Assets cancel
          out). Others combine for powerful synergies (King for a Day with Up in the Air
          gives all pieces flying king movement).
        </p>
      </div>
    </div>
  );
}
