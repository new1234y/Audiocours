// =====================================================
// CONFIGURATION SUPABASE - À MODIFIER AVEC VOS VALEURS
// =====================================================

const SUPABASE_CONFIG = {
  // Remplacez par votre URL Supabase
  url: "https://wihlcbsfgpchlvgguibx.supabase.co", // Ex: 'https://xxxxxxxxxxxx.supabase.co'

  // Remplacez par votre clé API publique (anon key)
  apiKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpaGxjYnNmZ3BjaGx2Z2d1aWJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQwMDAwNSwiZXhwIjoyMDgzOTc2MDA1fQ.C6CZDIvhuPbWg0CxB0eyzEqKABmImejD0CwbfbFJ558", // Ex: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

  // Nom de la table contenant les enregistrements audio
  tableName: "audiocours",

  // Nom du bucket Storage pour les fichiers audio
  storageBucket: "audios",
}

// =====================================================
// NE PAS MODIFIER EN DESSOUS DE CETTE LIGNE
// =====================================================

// Vérification de la configuration
function isSupabaseConfigured() {
  return SUPABASE_CONFIG.url !== "VOTRE_URL_SUPABASE" && SUPABASE_CONFIG.apiKey !== "VOTRE_CLE_API_SUPABASE"
}
