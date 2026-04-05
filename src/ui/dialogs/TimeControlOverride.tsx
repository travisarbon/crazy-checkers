/**
 * Time control override widget for the GameSetupDialog.
 *
 * Provides a timed/untimed toggle. When timed, shows the default
 * config summary with an option to change it via an inline
 * TimeControlSection.
 */

import { useState } from 'react';
import type { TimeControlConfig } from '../../engine/clock';
import TimeControlSection from '../TimeControlSection';
import { describeConfig } from '../timeControlPresets';
import styles from './GameSetupDialog.module.css';

interface TimeControlOverrideProps {
  defaultConfig: TimeControlConfig | null;
  onChange: (config: TimeControlConfig | null) => void;
  isVsCpu: boolean;
}

export default function TimeControlOverride({
  defaultConfig,
  onChange,
  isVsCpu,
}: TimeControlOverrideProps) {
  const [isTimed, setIsTimed] = useState(defaultConfig !== null);
  const [showSelector, setShowSelector] = useState(defaultConfig === null);
  const [overrideConfig, setOverrideConfig] = useState(defaultConfig);

  function handleToggle() {
    if (isTimed) {
      // Switching to untimed
      setIsTimed(false);
      onChange(null);
    } else {
      // Switching to timed
      setIsTimed(true);
      if (defaultConfig) {
        setOverrideConfig(defaultConfig);
        onChange(defaultConfig);
        setShowSelector(false);
      } else {
        // No default — show selector immediately
        setShowSelector(true);
      }
    }
  }

  function handleConfigChange(config: TimeControlConfig | null) {
    setOverrideConfig(config);
    onChange(config);
  }

  return (
    <div>
      <div className={styles.timedToggleRow}>
        <label htmlFor="timed-toggle" style={{ fontSize: '0.9rem', flex: 1 }}>
          Timed game
        </label>
        <button
          id="timed-toggle"
          role="switch"
          aria-checked={isTimed}
          className={[styles.toggleSwitch, isTimed ? styles.toggleOn : '']
            .filter(Boolean)
            .join(' ')}
          onClick={handleToggle}
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>

      {isTimed && !showSelector && defaultConfig && (
        <div className={styles.timeControlSummary}>
          Default: {describeConfig(defaultConfig)}
          <button
            onClick={() => { setShowSelector(true); }}
            style={{
              marginLeft: '0.75rem',
              background: 'transparent',
              border: '1px solid var(--ui-accent)',
              borderRadius: '4px',
              color: 'var(--ui-accent)',
              padding: '0.2rem 0.6rem',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Change
          </button>
        </div>
      )}

      {isTimed && showSelector && (
        <TimeControlSection
          value={overrideConfig}
          onChange={handleConfigChange}
          headingLevel="h3"
          idPrefix="tc-override"
        />
      )}

      {isVsCpu && isTimed && (
        <p className={styles.cpuNote}>
          In vs. CPU mode, the clock applies to you only. The CPU is not subject to time pressure.
        </p>
      )}
    </div>
  );
}
