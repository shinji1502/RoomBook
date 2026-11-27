import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../providers/auth_provider.dart';
import '../admin/admin_dashboard_screen.dart';
import 'history_screen.dart';
import 'home_screen.dart';
import 'profile_screen.dart';

class UserMainNav extends StatefulWidget {
  const UserMainNav({super.key});

  @override
  State<UserMainNav> createState() => _UserMainNavState();
}

class _UserMainNavState extends State<UserMainNav> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    // Jika admin, tambahkan tab Admin Dashboard
    final List<Widget> pages = [
      const HomeScreen(),
      const HistoryScreen(),
      if (auth.isAdmin) const AdminDashboardScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex >= pages.length ? 0 : _currentIndex,
        children: pages,
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: Color(0xFFE5E7EB))),
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex >= pages.length ? 0 : _currentIndex,
          onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
          backgroundColor: Colors.white,
          indicatorColor: AppTheme.primaryContainer.withOpacity(0.18),
          destinations: [
            const NavigationDestination(
              icon: Icon(Icons.meeting_room_outlined),
              selectedIcon: Icon(Icons.meeting_room_rounded, color: AppTheme.primary),
              label: 'Beranda',
            ),
            const NavigationDestination(
              icon: Icon(Icons.receipt_long_outlined),
              selectedIcon: Icon(Icons.receipt_long_rounded, color: AppTheme.primary),
              label: 'Riwayat',
            ),
            if (auth.isAdmin)
              const NavigationDestination(
                icon: Icon(Icons.admin_panel_settings_outlined),
                selectedIcon: Icon(Icons.admin_panel_settings_rounded, color: AppTheme.primary),
                label: 'Admin',
              ),
            const NavigationDestination(
              icon: Icon(Icons.person_outline_rounded),
              selectedIcon: Icon(Icons.person_rounded, color: AppTheme.primary),
              label: 'Akun',
            ),
          ],
        ),
      ),
    );
  }
}

