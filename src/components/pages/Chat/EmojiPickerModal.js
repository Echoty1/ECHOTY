// src/components/pages/Chat/EmojiPickerModal.jsx
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

// ─── Common emoji categories ───────────────────────────────────
const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
  '😘', '😗', '😙', '😚', '☺️', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳',
  '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤',
  '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫',
  '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '😴', '🤤', '😪', '😵', '🤐',
  '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '💀', '☠️', '👻',
  '👽', '👾', '🤖', '💩', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
  '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈',
  '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓',
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '👈', '👉', '👆', '🖕',
  '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅',
  '🤳', '💪', '🦾', '🦵', '🦶', '👣', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️',
  '👅', '👄', '💋', '🩸',
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋',
  '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🐚',
  '🪸', '🐟', '🐠', '🐡', '🦈', '🐬', '🐳', '🐋', '🐊', '🦭', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘',
  '🦛', '🦏', '🐃', '🐄', '🐂', '🐖', '🐏', '🐑', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛',
  '🪶', '🐓', '🦃', '🦚', '🦜', '🦢', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐿️', '🦔',
  '🐾', '🪄', '🪅', '🪆', '🪗', '🪘', '🪙', '🪚', '🪛', '🪜', '🪝', '🪞', '🪟', '🪠', '🪡', '🪢',
  '🪣', '🪤', '🪥', '🪦', '🪧', '🪨', '🪩', '🪪', '🪫', '🪬', '🪭', '🪮', '🪯', '🪰', '🪱', '🪲',
  '🪳', '🪴', '🪵', '🪶', '🪷', '🪸', '🪹', '🪺', '🪻', '🪼', '🪽', '🪾', '🪿', '🫀', '🫁', '🫂',
  '🫃', '🫄', '🫅', '🫆'
];

const EmojiPickerModal = ({ isOpen, onClose, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredEmojis, setFilteredEmojis] = useState(EMOJI_LIST);

  useEffect(() => {
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      // Simple name lookup – we only support common names
      const names = {
        'grinning': '😀', 'smiley': '😃', 'smile': '😄', 'beam': '😁',
        'joy': '😂', 'rofl': '🤣', 'blush': '😊', 'heart eyes': '😍',
        'loving': '🥰', 'kiss': '😘', 'yum': '😋', 'wink': '😜',
        'crazy': '🤪', 'nerd': '🤓', 'sunglasses': '😎', 'star struck': '🤩',
        'party': '🥳', 'smirk': '😏', 'unamused': '😒', 'cry': '😢',
        'sob': '😭', 'angry': '😠', 'rage': '😡', 'swear': '🤬',
        'exploding head': '🤯', 'hot': '🥵', 'cold': '🥶', 'scream': '😱',
        'fearful': '😨', 'anxious': '😰', 'hug': '🤗', 'thinking': '🤔',
        'cover mouth': '🤭', 'shush': '🤫', 'lying': '🤥', 'no mouth': '😶',
        'neutral': '😐', 'roll eyes': '🙄', 'sleeping': '😴', 'drooling': '🤤',
        'sleepy': '😪', 'dizzy': '😵', 'woozy': '🥴', 'nausea': '🤢',
        'sneeze': '🤧', 'mask': '😷', 'cowboy': '🤠', 'imp': '😈',
        'skull': '💀', 'ghost': '👻', 'alien': '👽', 'robot': '🤖',
        'poop': '💩', 'cat': '😺',
        'heart': '❤️', 'broken heart': '💔',
        'hand': '👋', 'thumbs up': '👍', 'thumbs down': '👎',
        'clap': '👏', 'pray': '🙏', 'muscle': '💪',
        'dog': '🐶', 'cat2': '🐱', 'rabbit': '🐰', 'fox': '🦊',
        'bear': '🐻', 'panda': '🐼', 'koala': '🐨', 'tiger': '🐯',
        'lion': '🦁', 'cow': '🐮', 'pig': '🐷', 'frog': '🐸',
        'monkey': '🐵', 'chicken': '🐔', 'eagle': '🦅', 'owl': '🦉',
        'bat': '🦇', 'wolf': '🐺', 'boar': '🐗', 'horse': '🐴',
        'unicorn': '🦄', 'bee': '🐝', 'caterpillar': '🐛', 'butterfly': '🦋',
        'snail': '🐌', 'ladybug': '🐞', 'ant': '🐜', 'turtle': '🐢',
        'snake': '🐍', 'lizard': '🦎', 't-rex': '🦖', 'brontosaurus': '🦕',
        'octopus': '🐙', 'squid': '🦑', 'shrimp': '🦐', 'lobster': '🦞',
        'shell': '🐚', 'coral': '🪸', 'fish': '🐟', 'blowfish': '🐡',
        'shark': '🦈', 'dolphin': '🐬', 'whale': '🐳', 'crocodile': '🐊',
        'leopard': '🐆', 'zebra': '🦓', 'gorilla': '🦍', 'orangutan': '🦧',
        'elephant': '🐘', 'hippopotamus': '🦛', 'rhinoceros': '🦏',
        'buffalo': '🐃', 'ox': '🐂', 'pig2': '🐖', 'sheep': '🐑',
        'goat': '🐐', 'deer': '🦌', 'dog2': '🐕', 'poodle': '🐩',
        'guide dog': '🦮', 'service dog': '🐕‍🦺', 'cat2': '🐈',
        'black cat': '🐈‍⬛', 'feather': '🪶', 'rooster': '🐓',
        'turkey': '🦃', 'peacock': '🦚', 'parrot': '🦜', 'swan': '🦢',
        'dove': '🕊️', 'rabbit2': '🐇', 'raccoon': '🦝',
        'skunk': '🦨', 'badger': '🦡', 'beaver': '🦫', 'otter': '🦦',
        'sloth': '🦥', 'chipmunk': '🐿️', 'hedgehog': '🦔',
        'paw prints': '🐾'
      };
      const matches = [];
      for (const [name, emoji] of Object.entries(names)) {
        if (name.includes(term)) matches.push(emoji);
      }
      setFilteredEmojis(matches.length > 0 ? matches : []);
    } else {
      setFilteredEmojis(EMOJI_LIST);
    }
  }, [searchTerm]);

  const handleSelect = (emoji) => {
    onSelect(emoji);
    onClose();
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="emoji-picker-overlay" onClick={onClose}>
      <div className="emoji-picker-content" onClick={(e) => e.stopPropagation()}>
        <div className="emoji-picker-header">
          <h3>Emoji</h3>
          <button className="emoji-picker-close" onClick={onClose}>✕</button>
        </div>
        <div className="emoji-picker-search">
          <input
            type="text"
            placeholder="Search emoji..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="emoji-picker-grid">
          {filteredEmojis.map((emoji, index) => (
            <button
              key={index}
              className="emoji-picker-item"
              onClick={() => handleSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EmojiPickerModal;