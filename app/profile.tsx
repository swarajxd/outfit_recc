import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView } from 'react-native';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileTabs from '@/components/profile/ProfileTabs';
import ProfileContent from '@/components/profile/ProfileContent';
import BottomNav from '@/components/profile/BottomNav';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState('posts');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <ScrollView style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Status Bar */}
        <View style={{ backgroundColor: '#000', paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' }}>
          <Text style={{ color: '#fff', fontSize: 12 }}>12:47</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>📶</Text>
            <Text style={{ color: '#fff', fontSize: 12 }}>🔋</Text>
          </View>
        </View>

        {/* Profile Content */}
        <ProfileHeader />
        <ProfileTabs activeTab={activeTab} setActiveTab={setActiveTab} />
        <ProfileContent activeTab={activeTab} />
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav />
    </SafeAreaView>
  );
}
