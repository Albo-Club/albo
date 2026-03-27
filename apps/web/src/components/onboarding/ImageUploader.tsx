/**
 * 🖼️ ImageUploader - Composant d'upload d'image avec optimisation
 * 
 * Ce composant gère l'upload d'images (avatar utilisateur ou logo workspace)
 * avec les fonctionnalités suivantes :
 * - Prévisualisation de l'image actuelle ou des initiales en fallback
 * - Upload avec optimisation automatique (redimensionnement + compression)
 * - Suppression de l'image
 * - Validation du type et de la taille
 */

import React, { useRef, useState } from 'react';
import { Upload, Trash2, Loader2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============================================================
// TYPES
// ============================================================

interface ImageUploaderProps {
  /** URL de l'image actuelle (ou null si aucune image) */
  currentImage: string | null;
  
  /** Callback appelé quand l'image change (upload ou suppression) */
  onImageChange: (url: string | null) => void;
  
  /** Bucket Supabase Storage où stocker l'image */
  bucket: 'avatars' | 'workspace-logos';
  
  /** ID utilisé pour créer le chemin de stockage */
  userId: string;
  
  /** Texte/initiale à afficher si pas d'image (fallback) */
  fallbackInitial?: string;
  
  /** Taille de l'avatar en pixels (par défaut: 80) */
  size?: 'sm' | 'md' | 'lg';
  
  /** Forme de l'avatar (par défaut: 'circle') */
  shape?: 'circle' | 'square';
  
  /** Désactiver les interactions */
  disabled?: boolean;
}

// ============================================================
// CONSTANTES
// ============================================================

/** Taille maximale acceptée AVANT optimisation (10 MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Types MIME acceptés */
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/** Taille de sortie après optimisation (en pixels) */
const OUTPUT_SIZE = 256;

/** Qualité de compression JPEG (0-1) */
const COMPRESSION_QUALITY = 0.85;

/** Mapping des tailles */
const SIZE_MAP = {
  sm: { avatar: 'h-12 w-12', text: 'text-sm' },
  md: { avatar: 'h-20 w-20', text: 'text-xl' },
  lg: { avatar: 'h-24 w-24', text: 'text-2xl' },
};

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

/**
 * Extrait les initiales d'un texte
 */
function getInitials(text: string): string {
  if (!text) return '?';
  
  if (text.includes('@')) {
    return text.split('@')[0].charAt(0).toUpperCase();
  }
  
  return text
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * 🔧 Optimise une image (redimensionne et compresse)
 */
async function optimizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      
      const minDimension = Math.min(img.width, img.height);
      const sourceX = (img.width - minDimension) / 2;
      const sourceY = (img.height - minDimension) / 2;
      
      ctx.drawImage(
        img,
        sourceX, sourceY,
        minDimension, minDimension,
        0, 0,
        OUTPUT_SIZE, OUTPUT_SIZE
      );
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        COMPRESSION_QUALITY
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export function ImageUploader({ 
  currentImage, 
  onImageChange, 
  bucket,
  userId,
  fallbackInitial = '?',
  size = 'md',
  shape = 'circle',
  disabled = false,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const sizeClasses = SIZE_MAP[size];
  const shapeClasses = shape === 'circle' ? 'rounded-full' : 'rounded-lg';

  const handleUploadClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Format non supporté', {
        description: 'Utilisez PNG, JPEG, GIF ou WebP',
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('Fichier trop volumineux', {
        description: 'La taille maximum est de 10 MB',
      });
      return;
    }

    setUploading(true);
    
    try {
      const optimizedBlob = await optimizeImage(file);
      const fileName = `${userId}/${Date.now()}.jpg`;

      if (currentImage) {
        const urlParts = currentImage.split(`/${bucket}/`);
        if (urlParts.length > 1) {
          const oldPath = urlParts[1];
          await supabase.storage.from(bucket).remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, optimizedBlob, { 
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      onImageChange(publicUrl);
      toast.success('Image mise à jour !');
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error("Échec de l'upload", {
        description: error.message || 'Une erreur est survenue',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!currentImage || disabled) return;

    setUploading(true);
    
    try {
      const urlParts = currentImage.split(`/${bucket}/`);
      if (urlParts.length > 1) {
        const path = urlParts[1];
        const { error } = await supabase.storage.from(bucket).remove([path]);
        if (error) throw error;
      }

      onImageChange(null);
      toast.success('Image supprimée');
      
    } catch (error: any) {
      console.error('Remove error:', error);
      toast.error('Échec de la suppression', {
        description: error.message || 'Une erreur est survenue',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {/* Avatar avec prévisualisation */}
      <div className="relative group">
        <Avatar className={`${sizeClasses.avatar} ${shapeClasses} border-2 border-border`}>
          {currentImage && <AvatarImage src={currentImage} alt="Image de profil" />}
          <AvatarFallback className={`${sizeClasses.text} bg-primary/10 text-primary font-semibold`}>
            {getInitials(fallbackInitial)}
          </AvatarFallback>
        </Avatar>
        
        {/* Overlay au survol pour changer l'image */}
        {!disabled && (
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={uploading}
            className={`
              absolute inset-0 flex items-center justify-center 
              ${shapeClasses} bg-black/50 opacity-0 group-hover:opacity-100 
              transition-opacity cursor-pointer
            `}
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            ) : (
              <Camera className="h-6 w-6 text-white" />
            )}
          </button>
        )}
      </div>

      {/* Boutons d'action */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUploadClick}
            disabled={uploading || disabled}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Upload...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {currentImage ? 'Changer' : 'Ajouter'}
              </>
            )}
          </Button>
          
          {currentImage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemove}
              disabled={uploading || disabled}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground">
          PNG, JPEG, GIF ou WebP • Max 10 MB
        </p>
      </div>

      {/* Input file caché */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}
