// src/components/pages/Profile/AvatarCustomizer.js
import React, { useState } from 'react';
import ECHOMOJI from '../../UI/ECHOMOJI';
import {
  SKINS,
  HAIR_STYLES,
  OUTFITS,
  EYE_COLORS,
  EYEBROW_STYLES,
  MOUTH_STYLES,
  MOOD_THEMES,
} from '../../../constants/echomoji';

const AvatarCustomizer = ({
  currentSkin,
  currentHair,
  currentMood,
  currentOutfit,
  currentEye,
  currentEyebrow,
  currentMouth,
  onSave,
  onCancel,
}) => {
  const [selectedSkinId, setSelectedSkinId] = useState(currentSkin?.id || 'light');
  const [selectedHairId, setSelectedHairId] = useState(currentHair || 'short');
  const [selectedOutfitId, setSelectedOutfitId] = useState(currentOutfit || 'default');
  const [selectedEyeId, setSelectedEyeId] = useState(currentEye || 'brown');
  const [selectedEyebrowId, setSelectedEyebrowId] = useState(currentEyebrow || 'natural');
  const [selectedMouthId, setSelectedMouthId] = useState(currentMouth || null);
  const [previewAnimation, setPreviewAnimation] = useState('idle');
  const [previewMood, setPreviewMood] = useState(currentMood || 'happy');
  const [activeTab, setActiveTab] = useState('skin');

  const activeSkin = SKINS.find((s) => s.id === selectedSkinId) || SKINS[0];

  const handleSave = () => {
    onSave({
      activeSkin: selectedSkinId,
      hairStyle: selectedHairId,
      outfit: selectedOutfitId,
      eyeColor: selectedEyeId,
      eyebrowStyle: selectedEyebrowId,
      mouthStyle: selectedMouthId,
    });
  };

  const handleRandomize = () => {
    const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
    setSelectedSkinId(rand(SKINS).id);
    setSelectedHairId(rand(HAIR_STYLES).id);
    setSelectedOutfitId(rand(OUTFITS).id);
    setSelectedEyeId(rand(EYE_COLORS).id);
    setSelectedEyebrowId(rand(EYEBROW_STYLES).id);
    const mouthChoices = [null, ...MOUTH_STYLES.map((m) => m.id)];
    setSelectedMouthId(rand(mouthChoices));
  };

  const tabs = [
    { id: 'skin', label: 'Skin' },
    { id: 'hair', label: 'Hair' },
    { id: 'outfit', label: 'Outfit' },
    { id: 'eyes', label: 'Eyes' },
    { id: 'face', label: 'Face' },
  ];

  const SectionTitle = ({ children }) => (
    <div
      style={{
        fontSize: '11px',
        color: 'var(--text-secondary)',
        marginBottom: '8px',
        fontWeight: 700,
        letterSpacing: '0.6px',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );

  const scrollRow = {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px',
  };

  const pill = (active) => ({
    padding: '8px 16px',
    borderRadius: '20px',
    border: active ? '2px solid #6C3CE1' : '1px solid var(--border-color)',
    background: active ? 'rgba(108, 60, 225, 0.12)' : 'var(--bg-input)',
    color: active ? '#6C3CE1' : 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
  });

  const swatch = (active, size = 44, radius = '50%') => ({
    width: size,
    height: size,
    borderRadius: radius,
    border: active ? '3px solid #6C3CE1' : '2px solid var(--border-color)',
    cursor: 'pointer',
    flexShrink: 0,
    boxShadow: active ? '0 0 12px rgba(108, 60, 225, 0.4)' : 'none',
    transition: 'all 0.2s',
  });

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '20px',
        marginTop: '16px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Live Preview */}
      <div
        style={{
          background: `radial-gradient(circle at 50% 30%, ${MOOD_THEMES[previewMood]?.glowColor}20, var(--bg-input) 70%)`,
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '220px',
          border: '1px solid var(--border-color)',
          gap: '12px',
        }}
      >
        <ECHOMOJI
          mood={previewMood}
          skin={activeSkin}
          hairStyle={selectedHairId}
          outfitId={selectedOutfitId}
          eyeColorId={selectedEyeId}
          eyebrowStyleId={selectedEyebrowId}
          mouthStyleId={selectedMouthId}
          animation={previewAnimation}
          size={120}
          interactive={false}
          animated={true}
        />

        {/* Mood Quick-Switch */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: '100%',
          }}
        >
          {Object.keys(MOOD_THEMES).map((m) => (
            <button
              key={m}
              onClick={() => setPreviewMood(m)}
              title={m}
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                border: previewMood === m ? '2px solid #EC4899' : '1px solid var(--border-color)',
                background: MOOD_THEMES[m].glowColor,
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      {/* Randomize + Save row */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleRandomize}
          style={{
            flex: 1,
            background: 'var(--bg-input)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            padding: '10px',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          🎲 Randomize
        </button>
        <button
          onClick={() => setPreviewAnimation(previewAnimation === 'idle' ? 'wave' : 'idle')}
          style={{
            flex: 1,
            background: 'var(--bg-input)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            padding: '10px',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          {previewAnimation === 'idle' ? '👋 Wave' : '😌 Idle'}
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          background: 'var(--bg-input)',
          borderRadius: '12px',
          padding: '4px',
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === t.id ? 'linear-gradient(135deg, #6C3CE1, #EC4899)' : 'transparent',
              color: activeTab === t.id ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '11px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'skin' && (
        <div style={{ width: '100%' }}>
          <SectionTitle>Skin Tone</SectionTitle>
          <div style={scrollRow}>
            {SKINS.map((skin) => (
              <button
                key={skin.id}
                onClick={() => setSelectedSkinId(skin.id)}
                title={skin.name + (skin.isLimited ? ' (Limited)' : '')}
                style={{
                  ...swatch(selectedSkinId === skin.id),
                  background: `linear-gradient(135deg, ${skin.skinLight}, ${skin.skinBase}, ${skin.skinShadow})`,
                  position: 'relative',
                }}
              >
                {skin.isLimited && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -4,
                      right: -4,
                      fontSize: '9px',
                      background: '#EC4899',
                      color: '#fff',
                      borderRadius: '6px',
                      padding: '1px 4px',
                      fontWeight: 700,
                    }}
                  >
                    ✦
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'hair' && (
        <div style={{ width: '100%' }}>
          <SectionTitle>Hair Style</SectionTitle>
          <div style={scrollRow}>
            {HAIR_STYLES.map((hair) => (
              <button
                key={hair.id}
                onClick={() => setSelectedHairId(hair.id)}
                style={pill(selectedHairId === hair.id)}
              >
                {hair.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'outfit' && (
        <div style={{ width: '100%' }}>
          <SectionTitle>Outfit Color</SectionTitle>
          <div style={scrollRow}>
            {OUTFITS.map((outfit) => (
              <button
                key={outfit.id}
                onClick={() => setSelectedOutfitId(outfit.id)}
                title={outfit.name}
                style={{
                  ...swatch(selectedOutfitId === outfit.id, 44, '12px'),
                  background: outfit.color
                    ? `linear-gradient(135deg, ${outfit.color}, ${outfit.shadow})`
                    : 'linear-gradient(135deg, #6C3CE1, #4A2A9E)',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'eyes' && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <SectionTitle>Eye Color</SectionTitle>
            <div style={scrollRow}>
              {EYE_COLORS.map((eye) => (
                <button
                  key={eye.id}
                  onClick={() => setSelectedEyeId(eye.id)}
                  title={eye.name}
                  style={{
                    ...swatch(selectedEyeId === eye.id, 40, '50%'),
                    background: eye.color,
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <SectionTitle>Eyebrows</SectionTitle>
            <div style={scrollRow}>
              {EYEBROW_STYLES.map((brow) => (
                <button
                  key={brow.id}
                  onClick={() => setSelectedEyebrowId(brow.id)}
                  style={pill(selectedEyebrowId === brow.id)}
                >
                  {brow.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'face' && (
        <div style={{ width: '100%' }}>
          <SectionTitle>Mouth Style</SectionTitle>
          <div style={scrollRow}>
            <button
              onClick={() => setSelectedMouthId(null)}
              style={pill(selectedMouthId === null)}
            >
              Auto
            </button>
            {MOUTH_STYLES.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMouthId(m.id)}
                style={pill(selectedMouthId === m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', width: '100%' }}>
        <button
          onClick={handleSave}
          style={{
            flex: 1,
            background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
            color: '#fff',
            border: 'none',
            padding: '12px',
            borderRadius: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          💾 Save Avatar
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            background: 'var(--bg-input)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            padding: '12px',
            borderRadius: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AvatarCustomizer;
