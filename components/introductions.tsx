import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { IconMusic, IconSearch, IconCheck, IconX } from '@tabler/icons-react';

interface iTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  artwork: string | null;
  preview: string | null;
  link: string;
  duration: number;
}

interface MemberProfile {
  introMessage?: string | null;
  trackId?: string | null;
  trackName?: string | null;
  artistName?: string | null;
  artwork?: string | null;
  previewUrl?: string | null;
}

export default function MemberIntroEditor() {
  const router = useRouter();
  const { id: workspaceId } = router.query;
  
  const [profile, setProfile] = useState<MemberProfile>({});
  const [introMessage, setIntroMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<iTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<iTrack | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load current profile
  useEffect(() => {
    if (!workspaceId) return;
    
    axios.get(`/api/workspace/${workspaceId}/member/profile`)
      .then(res => {
        if (res.data.success && res.data.profile) {
          const p = res.data.profile;
          setProfile(p);
          setIntroMessage(p.introMessage || '');
          
          if (p.trackId) {
            setSelectedTrack({
              id: p.trackId,
              name: p.trackName || '',
              artist: p.artistName || '',
              album: '',
              artwork: p.artwork || null,
              preview: p.previewUrl || null,
              link: p.previewUrl || '',
              duration: 0,
            });
          }
        }
      })
      .catch(err => {
        console.error('Error loading profile:', err);
      });
  }, [workspaceId]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const res = await axios.get(`/api/itunes/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.data.success === false && res.data.tracks) {
        setSearchResults(res.data.tracks || []);
      } else {
        setSearchResults(res.data.tracks || []);
      }
    } catch (err) {
      console.error('Error searching iTunes:', err);
      setMessage({ type: 'error', text: 'Failed to search iTunes.' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = async () => {
    if (!workspaceId) return;
    setIsSaving(true);
    setMessage(null);
    
    try {
      const res = await axios.put(`/api/workspace/${workspaceId}/member/profile`, {
        introMessage: introMessage.trim() || null,
        trackId: selectedTrack?.id || null,
        trackName: selectedTrack?.name || null,
        artistName: selectedTrack?.artist || null,
        artwork: selectedTrack?.artwork || null,
        previewUrl: selectedTrack?.preview || null,
      });
      
      if (res.data.success) {
        setMessage({ type: 'success', text: 'Your introduction has been saved!' });
        setProfile(res.data.profile);
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      setMessage({ type: 'error', text: 'Failed to save your introduction.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-6">
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Introduction Message
        </label>
        <textarea
          value={introMessage}
          onChange={(e) => setIntroMessage(e.target.value)}
          placeholder="Tell your team about yourself..."
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
          rows={1}
          maxLength={15}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          {introMessage.length}/15 characters
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Favorite Song
        </label>
        
        {selectedTrack && (
          <div className="mb-3 flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg p-3">
            {selectedTrack.artwork && (
              <img src={selectedTrack.artwork} alt={selectedTrack.name} className="w-12 h-12 rounded object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                {selectedTrack.name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {selectedTrack.artist}
              </p>
            </div>
            <button
              onClick={() => setSelectedTrack(null)}
              className="text-zinc-400 hover:text-red-500"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search..."
            className="flex-1 min-w-0 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="shrink-0 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <IconSearch className="w-4 h-4" />
            <span className="hidden sm:inline">{isSearching ? 'Searching...' : 'Search'}</span>
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-3 max-h-64 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg">
            {searchResults.map((track) => (
              <button
                key={track.id}
                onClick={() => {
                  setSelectedTrack(track);
                  setSearchResults([]);
                  setSearchQuery('');
                }}
                className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition text-left"
              >
                {track.artwork && (
                  <img src={track.artwork} alt={track.name} className="w-10 h-10 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                    {track.name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {track.artist} • {track.album}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
        >
          <IconCheck className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
