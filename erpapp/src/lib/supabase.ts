import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jtgtrdqoonsmckaxyoik.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0Z3RyZHFvb25zbWNrYXh5b2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDE2MDgsImV4cCI6MjA3ODQxNzYwOH0.Z_CR-n04Mx3FKPm6Y9bnYZooxQHGZYgbi0wRe7l5fKw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)