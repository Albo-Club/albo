import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { ImageUploader } from '@/components/onboarding/ImageUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function CreateProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Charger les données existantes du profil
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, phone, linkedin_url, avatar_url')
        .eq('id', user.id)
        .single();

      if (profile) {
        // Séparer le nom si existant
        if (profile.name) {
          const parts = profile.name.split(' ');
          setFirstName(parts[0] || '');
          setLastName(parts.slice(1).join(' ') || '');
        }
        setPhone(profile.phone || '');
        setLinkedinUrl(profile.linkedin_url || '');
        setAvatarUrl(profile.avatar_url || null);
      }
    };

    loadProfile();
  }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim()) {
      toast.error('Please enter your first name');
      return;
    }

    if (!user?.id) {
      toast.error('You must be logged in');
      return;
    }

    setLoading(true);

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      
      // Mettre à jour le profil
      const { error } = await supabase
        .from('profiles')
        .update({
          name: fullName,
          phone: phone.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          avatar_url: avatarUrl,
          is_complete: true,
          onboarding_status: 'invite_team',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Profile updated successfully!');
      navigate('/onboarding/invite');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingModal 
      title="Create your profile" 
      subtitle="Tell us about yourself"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Avatar */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">Picture</Label>
          <ImageUploader
            currentImage={avatarUrl}
            onImageChange={setAvatarUrl}
            bucket="avatars"
            userId={user?.id || 'temp'}
            fallbackInitial={firstName || user?.email || '?'}
          />
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">Name</Label>
          <p className="text-xs text-gray-400">
            Your name as it will be displayed on the app
          </p>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <div>
              <Label className="text-xs text-gray-500">First Name</Label>
              <Input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                required
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Last Name</Label>
              <Input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <Label className="text-sm font-medium text-gray-700">
            Phone number (optional)
          </Label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+33 6 12 34 56 78"
          />
        </div>

        {/* LinkedIn */}
        <div className="space-y-1">
          <Label className="text-sm font-medium text-gray-700">
            LinkedIn (optional)
          </Label>
          <Input
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/in/johndoe"
          />
        </div>

        {/* Submit Button */}
        <Button 
          type="submit" 
          disabled={loading}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-lg"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </form>
    </OnboardingModal>
  );
}
