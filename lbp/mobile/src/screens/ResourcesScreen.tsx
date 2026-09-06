import React from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { RESOURCES_CATEGORIES } from "../data/resources";
import { colors, radius, spacing } from "../theme";

// Mirrors the website's /:locale/resources index (ResourcesIndex in
// ui.tsx): a "Start here" row of 3 picks, then the full category grid.
// Deliberately English-only, same as the site - see src/data/resources.ts
// for why. The site's own closing "Create free account" CTA is dropped
// here since everyone reaching this screen is already logged in.
export default function ResourcesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heroEyebrow}>RESOURCES & TOOLS</Text>
      <Text style={styles.heroTitle}>Parenthood resources and tools</Text>
      <Text style={styles.heroBody}>
        Practical checklists, worksheets and planning tools to help you explore co-parenting, fertility, donor
        conception and the practical side of becoming a parent.
      </Text>

      <Text style={styles.sectionTitle}>Start here</Text>
      <Pressable
        style={styles.startCard}
        onPress={() => navigation.navigate("ResourceTool", { categorySlug: "co-parenting", toolSlug: "planning-template" })}
      >
        <Text style={styles.startIcon}>📄</Text>
        <Text style={styles.startCardTitle}>Co-Parenting Planning Template</Text>
        <Text style={styles.startCardBody}>
          Thinking about becoming co-parents? Talk through parenting, finances, living arrangements and boundaries
          before you move forward.
        </Text>
        <Text style={styles.startCardLink}>Download the template →</Text>
      </Pressable>
      <Pressable
        style={styles.startCard}
        onPress={() => navigation.navigate("ResourceTool", { categorySlug: "co-parenting", toolSlug: "questions-to-ask" })}
      >
        <Text style={styles.startIcon}>📄</Text>
        <Text style={styles.startCardTitle}>Questions to Ask a Potential Co-Parent</Text>
        <Text style={styles.startCardBody}>
          Not sure what to ask before taking the next step? A practical list covering parenting, money,
          communication and everyday life.
        </Text>
        <Text style={styles.startCardLink}>View the questions →</Text>
      </Pressable>
      <Pressable style={[styles.startCard, styles.startCardFeatured]} onPress={() => navigation.navigate("CompatibilityQuiz")}>
        <Text style={styles.startIcon}>🧭</Text>
        <Text style={styles.startCardTitle}>Co-Parenting Compatibility Quiz</Text>
        <Text style={styles.startCardBody}>
          See where your expectations line up, and what's worth discussing further. It won't tell you whether
          you're a "match."
        </Text>
        <Text style={styles.startCardLink}>Take the quiz →</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Explore all</Text>
      {RESOURCES_CATEGORIES.map((cat) => (
        <View key={cat.slug} style={styles.categoryCard}>
          <Text style={styles.categoryEyebrow}>{cat.eyebrow.toUpperCase()}</Text>
          <Text style={styles.categoryTitle}>{cat.title}</Text>
          <Text style={styles.categoryBody}>{cat.description}</Text>
          {cat.tools.map((tool) => (
            <Pressable
              key={tool.slug}
              onPress={() => navigation.navigate("ResourceTool", { categorySlug: cat.slug, toolSlug: tool.slug })}
            >
              <Text style={styles.categoryToolLink}>• {tool.title}</Text>
            </Pressable>
          ))}
          {cat.disclaimer ? <Text style={styles.categoryNote}>{cat.disclaimer}</Text> : null}
          <Pressable style={styles.categoryCta} onPress={() => navigation.navigate("ResourceCategory", { slug: cat.slug })}>
            <Text style={styles.categoryCtaText}>Explore {cat.eyebrow.toLowerCase()} →</Text>
          </Pressable>
        </View>
      ))}

      <View style={styles.proCard}>
        <Text style={styles.proIcon}>💬</Text>
        <Text style={styles.proTitle}>Looking for professional guidance?</Text>
        <Text style={styles.proBody}>
          Some questions are better discussed with a qualified professional. LetsBeParents is building a trusted
          space to connect people with psychological, medical and other professional support when they need it.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  heroEyebrow: { color: colors.pink, fontWeight: "700", fontSize: 12, letterSpacing: 0.5 },
  heroTitle: { fontSize: 24, fontWeight: "800", color: colors.ink, marginTop: spacing.xs },
  heroBody: { color: colors.muted, fontSize: 14, marginTop: spacing.sm, lineHeight: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.sm },
  startCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  startCardFeatured: { borderWidth: 1, borderColor: colors.pink },
  startIcon: { fontSize: 22, marginBottom: spacing.xs },
  startCardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  startCardBody: { fontSize: 13, color: colors.muted, marginTop: spacing.xs, lineHeight: 18 },
  startCardLink: { fontSize: 13, fontWeight: "700", color: colors.pink, marginTop: spacing.sm },
  categoryCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  categoryEyebrow: { fontSize: 11, fontWeight: "700", color: colors.pink, letterSpacing: 0.5 },
  categoryTitle: { fontSize: 17, fontWeight: "800", color: colors.ink, marginTop: spacing.xs },
  categoryBody: { fontSize: 13, color: colors.muted, marginTop: spacing.xs, lineHeight: 18 },
  categoryToolLink: { fontSize: 14, color: colors.ink, marginTop: spacing.sm },
  categoryNote: { fontSize: 12, color: colors.muted, marginTop: spacing.md, fontStyle: "italic" },
  categoryCta: { marginTop: spacing.md },
  categoryCtaText: { fontSize: 13, fontWeight: "700", color: colors.pink },
  proCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    alignItems: "flex-start",
  },
  proIcon: { fontSize: 22, marginBottom: spacing.xs },
  proTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  proBody: { fontSize: 13, color: colors.muted, marginTop: spacing.xs, lineHeight: 18 },
});
