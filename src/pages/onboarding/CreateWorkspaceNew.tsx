import { useState } from 'react';
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

export default function CreateWorkspaceNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [workspaceName, setWorkspaceName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!workspaceName.trim()) {
      toast.error('Please enter a workspace name');
      return;
    }

    if (!user?.id) {
      toast.error('You must be logged in');
      return;
    }

    setLoading(true);

    try {
      // Créer le workspace
      const { data: workspaceId, error } = await supabase.rpc('create_workspace', {
        _name: workspaceName.trim(),
        _owner_id: user.id,
      });

      if (error) throw error;

      // Mettre à jour le logo si uploadé
      if (logoUrl && workspaceId) {
        await supabase
          .from('workspaces')
          .update({ logo_url: logoUrl })
          .eq('id', workspaceId);
      }

      // Sauvegarder le workspace ID
      if (workspaceId) {
        localStorage.setItem('currentWorkspaceId', workspaceId);
      }

      // Nettoyer l'invitation en attente si elle existe
      localStorage.removeItem('pending_invitation');

      // Mettre à jour le statut d'onboarding
      await supabase
        .from('profiles')
        .update({ onboarding_status: 'profile_pending' })
        .eq('id', user.id);

      toast.success('Workspace created successfully!');
      navigate('/onboarding/profile');
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      toast.error(error.message || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingModal 
      title="Create your workspace" 
      subtitle="A workspace is a shared environment where your team can collaborate"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Workspace Logo */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">
            Workspace logo
          </Label>
          <ImageUploader
            currentImage={logoUrl}
            onImageChange={setLogoUrl}
            bucket="workspace-logos"
            userId={user?.id || 'temp'}
            fallbackInitial={workspaceName || 'W'}
          />
        </div>

        {/* Workspace Name */}
        <div className="space-y-1">
          <Label className="text-sm font-medium text-gray-700">
            Workspace name
          </Label>
          <p className="text-xs text-gray-400">
            The name of your organization
          </p>
          <Input
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="Albo"
            className="mt-1"
            required
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
              Creating...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </form>
    </OnboardingModal>
  );
}
